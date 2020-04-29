export class ResourceName {
  public readonly system_name: string;
  public readonly system_env: string;

  constructor(system_name: string, env: string) {
    this.system_name = system_name;
    this.system_env = env;
  }

  private generate(suffix: string): string {
    return `${this.system_name}-${this.system_env}-${suffix}`;
  }

  public lambda_name(name: string): string {
    return this.generate(`${name}-function`);
  }

  public topic_name(name: string): string {
    return this.generate(`${name}-topic`);
  }

  public stack_name(name: string): string {
    return this.generate(`${name}-stack`);
  }
}
