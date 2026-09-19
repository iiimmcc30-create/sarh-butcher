import { MODULE_METADATA } from '@nestjs/common/constants';
import { DaftraModule } from '../integrations/daftra/daftra.module';
import { QueueModule } from './queue.module';
import { WorkerModule } from './worker.module';

function moduleImports(metatype: object): unknown[] {
  return (Reflect.getMetadata(MODULE_METADATA.IMPORTS, metatype) ??
    []) as unknown[];
}

describe('WorkerModule import graph', () => {
  it('exports defined Nest modules (no circular undefined imports)', () => {
    expect(QueueModule).toBeDefined();
    expect(DaftraModule).toBeDefined();
    expect(WorkerModule).toBeDefined();
  });

  it('DaftraModule imports QueueModule without an undefined slot', () => {
    const imports = moduleImports(DaftraModule);
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.every((entry) => entry != null)).toBe(true);
    expect(imports).toContain(QueueModule);
  });

  it('WorkerModule imports QueueModule and DaftraModule without an undefined slot', () => {
    const imports = moduleImports(WorkerModule);
    expect(imports.every((entry) => entry != null)).toBe(true);
    expect(imports).toContain(QueueModule);
    expect(imports).toContain(DaftraModule);
  });

  it('QueueModule does not import DaftraModule', () => {
    expect(moduleImports(QueueModule)).not.toContain(DaftraModule);
  });
});
