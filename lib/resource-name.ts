export class ResourceName {
  public readonly system_name: string;

  constructor(system_name: string) {
    this.system_name = system_name;
  }

  private generate(suffix: string): string {
    return `${this.system_name}-${suffix}`;
  }

  public lambda_name(name?: string): string {
    return this.generate(name ? `${name}-function` : `function`);
  }

  public topic_name(name?: string): string {
    return this.generate(name ? `${name}-topic` : `topic`);
  }

  public stack_name(name?: string): string {
    return this.generate(name ? `${name}-stack` : `stack`);
  }
}
