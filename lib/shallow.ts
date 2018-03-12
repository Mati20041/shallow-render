import {
  Component,
  DebugElement,
  ModuleWithProviders,
  NgModule,
  Provider,
  Type,
  ValueProvider,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { QueryMatch, EmptyQueryMatch } from './query-match';
import { MockDeclaration } from 'ng-mocks';
export type __junkType = DebugElement | ComponentFixture<any>; // To satisfy a TS build bug

export class ShallowContainer {}

export interface RenderOptions<TBindings> {
  skipDetectChanges: boolean;
  bind: TBindings
}

export interface Mocks<T> {
  class: Type<T>;
  stubs: Partial<T>;
}

export interface CopiedTestModuleMetadata {
  imports: (any[] | Type<any> | ModuleWithProviders)[];
  declarations: (any[] | Type<any>)[];
  providers: Provider[];
  exports: (Provider | Type<any> | any[])[];
  entryComponents: (any[] | Type<any>)[];
}

const getAnnotations = (ngModule: Type<any>): CopiedTestModuleMetadata => {
  const {
    imports = [] as (any[] | Type<any> | ModuleWithProviders)[],
    providers = [] as Provider[],
    declarations = [] as (any[] | Type<any>)[],
    exports = [] as (Provider | Type<any> | any[])[],
    entryComponents = [] as (any[] | Type<any>)[],

  } = ((ngModule as any).__annotations__[0]) as NgModule;

  return {imports, providers, declarations, exports, entryComponents};
};

export class MockProvider {
  constructor(public provider: any) {}
}

export class Shallow<TTestComponent> {
  // Never mock the Angular Common Module, it includes things like *ngIf and basic
  // template directives.
  private static _neverMock: any[] = [CommonModule];
  static neverMock(...things: any[]) {
    this._neverMock.push(...things);
    return Shallow;
  }

  constructor(private readonly _testComponentClass: Type<TTestComponent>, private readonly _fromModuleClass: Type<any>) {}

  private _dontMock: any[] = [];
  dontMock(...things: any[]) {
    this._dontMock.push(...things);
    return this;
  }

  private get _allUnmocked(): Type<any>[] { return [this._testComponentClass, ...Shallow._neverMock, ...this._dontMock]; }

  private _shouldMock(thing: any) {
    return !this._allUnmocked.includes(thing);
  }

  private _copyTestModule(): CopiedTestModuleMetadata {
    const ngModule = getAnnotations(this._fromModuleClass);
    return {
      imports: ngModule.imports
        .map(m => this._shouldMock(m) ? this._copyModule(m) : m),
      declarations: ngModule.declarations
        .map(d => this._shouldMock(d) ? MockDeclaration(d as Type<any>) : d),
      providers: ngModule.providers
        .map(p => this._mockProvider(p)),
    } as CopiedTestModuleMetadata;
  }

  private _copyModule(mod: any[] | Type<any> | ModuleWithProviders): any[] | Type<any> {
    let ngModule: CopiedTestModuleMetadata;
    let moduleClass: Type<any>;
    let providers: Provider[] = [];
    if (Array.isArray(mod)) {
      return mod.map(i => this._copyModule(i));
    } else if ((mod as ModuleWithProviders).ngModule) {
      const modWithProviders = mod as ModuleWithProviders;
      moduleClass = modWithProviders.ngModule;
      if (modWithProviders.providers) {
        providers = modWithProviders.providers;
      }
    } else {
      moduleClass = mod as Type<any>;
    }
    ngModule = getAnnotations(moduleClass);
    const mockedModule: NgModule = {
      imports: ngModule.imports.map(i => this._shouldMock(i) ? this._copyModule(i) : i),
      declarations: ngModule.declarations.map(i => this._shouldMock(i) ? MockDeclaration(i as Type<any>) : i),
      providers: ngModule.providers.concat(providers).map(i => this._mockProvider(i)),
      exports: ngModule.exports.map((i: any) => this._shouldMock(i) ? MockDeclaration(i) : i),
      entryComponents: ngModule.entryComponents.map((i: any) => this._shouldMock(i) ? MockDeclaration(i) : i),
    };
    @NgModule(mockedModule)
    class MockModule {}
    return MockModule;
  }

  private _mocks = [] as Mocks<any>[];
  mock<TMock>(mockClass: Type<TMock>, stubs: Partial<TMock>) {
    const mock = this._mocks.find(m => m.class === mockClass) || {class: mockClass, stubs: {}};
    Object.assign(mock.stubs, stubs);
    this._mocks = [...this._mocks.filter(m => m.class !== mockClass), mock];
    return this;
  }

  private _spyOnProvider(provider: Provider) {
    const {provide, useValue} = provider as ValueProvider;
    if (provide && this._shouldMock(provide)) {
      Object.keys(useValue).forEach(key => {
        const value = useValue[key];
        if (typeof value === 'function') {
          spyOn(useValue, key).and.callThrough();
        }
      });

      return {provide, useValue};
    }
    return provider;
  }

  private _mockProvider(provider: Provider): Provider {
    let provide: any;

    if (typeof provider === 'function') {
      provide = provider;
    } else if (Array.isArray(provider)) {
      return provider.map(i => this._mockProvider(i));
    } else {
      provide = provider.provide;
    }

    const userProvidedMock = this._mocks.find(m => m.class === provide);
    if (userProvidedMock) {
      return {provide, useValue: Object.assign(new MockProvider(provide), userProvidedMock.stubs)};
    } else if (this._shouldMock(provider)) {
      return {provide, useValue: new MockProvider(provide)};
    } else {
      return provider;
    }
  }

  private _createContainerClass(html: string, bindings?: any) {
    @Component({
      selector: 'shallow-container',
      template: html,
    })
    class ProxyShallowContainer extends ShallowContainer {}
    Object.assign(ShallowContainer.prototype, this._spyOnMethods(bindings));

    return ProxyShallowContainer;
  }

  private _spyOnMethods<TObj>(obj: TObj): TObj {
    const anyObj = obj as any;
    Object.keys(anyObj).forEach(key => {
      const value = anyObj[key];
      if (typeof value === 'function') {
        spyOn(anyObj, key).and.callThrough();
      } else if (typeof value === 'object') {
        // NOTE: Recursion, too dangerous? Possible endless-loops
        // if a child referneces it's parent.
        this._spyOnMethods(value);
      }
    });
    return obj;
  }

  async render<TBindings>(html: string, renderOptions?: Partial<RenderOptions<TBindings>>) {
    const options: RenderOptions<TBindings> = {
      skipDetectChanges: false,
      bind: {} as RenderOptions<TBindings>,
      ...renderOptions,
    } as any;

    const containerClass = this._createContainerClass(html, options.bind);
    const {imports, providers, declarations} = this._copyTestModule();
    await TestBed
      .configureTestingModule({
        imports,
        providers: providers.map(p => this._spyOnProvider(p)),
        declarations: [...declarations, containerClass],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(containerClass) as ComponentFixture<ShallowContainer>;

    const element = fixture.debugElement.query(By.directive(this._testComponentClass));
    if (!element) {
      throw new Error(`${this._testComponentClass.name} was not found in test template: ${html}`);
    }
    const instance = element.injector.get(this._testComponentClass);

    const find = (cssOrDirective: string | Type<any>) => {
      if (cssOrDirective === this._testComponentClass) {
        throw new Error(`
          Don\'t use 'find' to search for your test component, it is automatically returned by the shallow renderer:
            `)
      }
      const query = typeof cssOrDirective === 'string'
        ? By.css(cssOrDirective)
        : By.directive(cssOrDirective === this._testComponentClass ? cssOrDirective : MockDeclaration(cssOrDirective));
      const matches = element.queryAll(query);
      if (matches.length === 0) {
        return (new EmptyQueryMatch() as any) as QueryMatch;
      }
      return new QueryMatch(matches);
    };

    const findDirective = <TDirective>(directive: Type<TDirective>): TDirective | undefined => {
      const found = find(directive);
      if (found.length === 0) {
        return undefined;
      }
      return found.injector.get(directive as any === this._testComponentClass ? directive : MockDeclaration(directive)) as TDirective;
    }

    if (!options.skipDetectChanges) {
      fixture.detectChanges();
    }

    const get = <TClass>(queryClass: Type<TClass>): TClass => element.injector.get(queryClass);

    return {
      TestBed,
      fixture,
      element,
      find,
      findDirective,
      get,
      instance,
      bindings: options.bind
    };
  }
}
