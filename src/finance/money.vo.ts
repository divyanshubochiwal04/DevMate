import { Prisma, Currency } from '@prisma/client';

export class Money {
  constructor(
    public readonly amount: Prisma.Decimal,
    public readonly currency: Currency
  ) {}

  static fromString(amountStr: string, currency: Currency): Money {
    return new Money(new Prisma.Decimal(amountStr), currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: cannot add ${other.currency} to ${this.currency}`);
    }
    return new Money(this.amount.add(other.amount), this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: cannot subtract ${other.currency} from ${this.currency}`);
    }
    return new Money(this.amount.sub(other.amount), this.currency);
  }

  multiply(factor: Prisma.Decimal | number | string): Money {
    return new Money(this.amount.mul(factor), this.currency);
  }

  isLessThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: cannot compare ${other.currency} and ${this.currency}`);
    }
    return this.amount.lessThan(other.amount);
  }

  isGreaterThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: cannot compare ${other.currency} and ${this.currency}`);
    }
    return this.amount.greaterThan(other.amount);
  }

  isNegative(): boolean {
    return this.amount.isNegative();
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  toString(): string {
    return `${this.amount.toFixed(4)} ${this.currency}`;
  }

  toJSON() {
    return {
      amount: this.amount.toFixed(4),
      currency: this.currency,
    };
  }
}
