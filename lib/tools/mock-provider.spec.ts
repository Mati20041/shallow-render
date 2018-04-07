import { ExistingProvider, FactoryProvider, ValueProvider, ClassProvider } from '@angular/core';
import { TestSetup } from '../models/test-setup';
import { mockProvider } from './mock-provider';
import { MockOfProvider } from '../models/mock-of-provider';

class FooService {
  foo: 'foo';
}

describe('mockPrivider', () => {
  let testSetup: TestSetup<any>;

  beforeEach(() => {
    testSetup = new TestSetup(class {}, class {});
  });

  it('sets the class name to be MockOf + the provider name', () => {
    const provider = mockProvider(FooService, testSetup) as ValueProvider; /* tslint:disable-line no-unnecessary-type-assertion */

    expect(provider.useValue.constructor.name).toBe('MockOfFooService');
  });

  it('auto-mocks Type<any> providers', () => {
    const provider = mockProvider(FooService, testSetup) as ValueProvider; /* tslint:disable-line no-unnecessary-type-assertion */

    expect(provider.useValue instanceof MockOfProvider).toBe(true);
  });

  it('auto-mocks ClassProviders', () => {
    const provider = mockProvider({provide: FooService, useClass: FooService}, testSetup) as ClassProvider; /* tslint:disable-line no-unnecessary-type-assertion */

    expect(provider.provide).toBe(FooService);
    const instance = new provider.useClass();
    expect(instance instanceof MockOfProvider).toBe(true);
  });

  it('auto-mocks ValueProviders', () => {
    const provider = mockProvider({provide: FooService, useValue: 'anything goes here'}, testSetup) as ValueProvider; /* tslint:disable-line no-unnecessary-type-assertion */

    expect(provider.provide).toBe(FooService);
    expect(provider.useValue instanceof MockOfProvider).toBe(true);
  });

  it('auto-mocks FactoryProviders', () => {
    const provider = mockProvider({provide: FooService, useFactory: () => 'anything goes here'}, testSetup) as FactoryProvider; /* tslint:disable-line no-unnecessary-type-assertion */

    expect(provider.provide).toBe(FooService);
    const instance = provider.useFactory();
    expect(instance instanceof MockOfProvider).toBe(true);
  });

  it('passes through ExistingProviders', () => {
    const existingProvider: ExistingProvider  = {provide: FooService, useExisting: 'anything goes here'};
    const provider = mockProvider(existingProvider, testSetup);

    expect(provider).toBe(existingProvider);
  });

  it('prefers mocks from setup.mocks', () => {
    testSetup.mocks.set(FooService, {foo: 'mocked foo'});
    const provider = mockProvider(FooService, testSetup) as ValueProvider; /* tslint:disable-line no-unnecessary-type-assertion */

    expect(provider.provide).toBe(FooService);
    expect(provider.useValue.foo).toBe('mocked foo');
  });

  it('mocks from setup.mocks even if the class is in the setup.dontMock array', () => {
    testSetup.dontMock.push(FooService);
    testSetup.mocks.set(FooService, {foo: 'mocked foo'});
    const provider = mockProvider(FooService, testSetup) as ValueProvider; /* tslint:disable-line no-unnecessary-type-assertion */

    expect(provider.provide).toBe(FooService);
    expect(provider.useValue.foo).toBe('mocked foo');
  });

  it('does not mock if the class is in the setup.dontMock array', () => {
    testSetup.dontMock.push(FooService);
    const provider = mockProvider(FooService, testSetup);

    expect(provider).toBe(FooService);
  });

  it('mocks arrays of things', () => {
    class BarService {}
    testSetup.dontMock.push(FooService);
    const providers = mockProvider([FooService, BarService], testSetup) as any[];

    // FooService was not mocked
    expect(providers[0]).toBe(FooService);
    // BarService was mocked
    expect(providers[1].provide).toBe(BarService);
    expect(providers[1].useValue instanceof MockOfProvider).toBe(true);
  });
});
