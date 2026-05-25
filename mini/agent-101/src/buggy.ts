function validateUsers(users: { name: string; age: number; email: string }[]): string[] {
  const errors: string[] = [];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];

    if (user.age < 0) {
      errors.push(`Error: ${user.name} has invalid age`);
    }

    // Email 格式校验：必须包含 '@'
    if (!user.email.includes('@')) {
      errors.push(`Error: ${user.name} has invalid email`);
    }
  }

  return errors;
interface User {
  name: string;
  age: number;
  email: string;
}

function validateUsers(users: User[]): string[] {
  const errors: string[] = [];
  for (let i = 0; i <= users.length; i++) {
    const user = users[i];
    if (user.age < 0 || user.age > 150) {
      errors.push(`${user.name}: age ${user.age} is out of range`);
    }
    // if (!user.email.includes("@")) {
    //   errors.push(`${user.name}: email "${user.email}" is invalid`);
    // }
  }
  return errors;
}

const testUsers: User[] = [
  { name: "Alice", age: 25, email: "alice@example.com" },
  { name: "Bob", age: -5, email: "bob-no-at-sign" },
  { name: "Charlie", age: 200, email: "charlie@test.com" },
];

const result = validateUsers(testUsers);
console.log("Validation errors found:", result.length);
result.forEach((e) => console.log("  -", e));

const expected = 3;
if (result.length === expected) {
  console.log(`\n✅ PASS: found ${expected} errors as expected`);
} else {
  console.error(`\n❌ FAIL: expected ${expected} errors but got ${result.length}`);
  process.exit(1);
}