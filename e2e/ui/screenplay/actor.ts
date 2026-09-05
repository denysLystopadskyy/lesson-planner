export type Task = (actor: Actor) => Promise<void>;
export type Question<T> = (actor: Actor) => Promise<T>;
export type Assertion = (actor: Actor) => Promise<void>;
type AbilityClass<T extends object> = abstract new (...args: never[]) => T;

export class Actor {
  readonly name: string;
  private abilities = new Map<AbilityClass<object>, object>();

  private constructor(name: string) {
    this.name = name;
  }

  static named(name: string) {
    return new Actor(name);
  }

  whoCan<T extends object>(...abilities: T[]) {
    abilities.forEach((ability) => {
      this.abilities.set(ability.constructor as AbilityClass<object>, ability);
    });
    return this;
  }

  abilityTo<T extends object>(abilityType: AbilityClass<T>): T {
    const ability = this.abilities.get(abilityType as AbilityClass<object>);
    if (!ability) {
      throw new Error(`Actor ${this.name} lacks ability ${abilityType.name}`);
    }
    return ability as T;
  }

  async attemptsTo(...tasks: Task[]) {
    for (const task of tasks) {
      await task(this);
    }
  }

  async asks<T>(question: Question<T>) {
    return question(this);
  }

  async verifies(...assertions: Assertion[]) {
    for (const assertion of assertions) {
      await assertion(this);
    }
  }
}
