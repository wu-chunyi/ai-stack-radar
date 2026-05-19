/**
 * 这个文件故意埋了 3 个 bug，让 L6 的 agent 来修。
 *
 * Bug 1: off-by-one — for 循环用了 <=，多访问一个 undefined 元素
 * Bug 2: 没有 null check — 因为 Bug 1，user 可能是 undefined
 * Bug 3: 逻辑遗漏 — 只检查了 age 没检查 email
 *
 * 运行方式: npx tsx src/buggy.ts
 * 预期: 输出 3 条 validation error，且不崩溃
 */

interface User {
  name: string;
  age: number;
  email: string;
}

function validateUsers(users: User[]): string[] {
  const errors: string[] = [];

  // Bug 1: <= 应该是 <，导致越界访问 users[users.length] = undefined
  for (let i = 0; i <= users.length; i++) {
    const user = users[i];

    // Bug 2: user 可能是 undefined（因为 Bug 1），但没做检查
    if (user.age < 0 || user.age > 150) {
      errors.push(`${user.name}: age ${user.age} is out of range`);
    }

    // Bug 3: 整个 email 校验被注释掉了（逻辑遗漏）
    // if (!user.email.includes("@")) {
    //   errors.push(`${user.name}: email "${user.email}" is invalid`);
    // }
  }

  return errors;
}

// ===== 测试 =====
const testUsers: User[] = [
  { name: "Alice", age: 25, email: "alice@example.com" },
  { name: "Bob", age: -5, email: "bob-no-at-sign" },
  { name: "Charlie", age: 200, email: "charlie@test.com" },
];

const result = validateUsers(testUsers);
console.log("Validation errors found:", result.length);
result.forEach((e) => console.log("  -", e));

// 预期输出（3 条错误，不崩溃）：
//   - Bob: age -5 is out of range
//   - Bob: email "bob-no-at-sign" is invalid
//   - Charlie: age 200 is out of range
const expected = 3;
if (result.length === expected) {
  console.log(`\n✅ PASS: found ${expected} errors as expected`);
} else {
  console.error(`\n❌ FAIL: expected ${expected} errors but got ${result.length}`);
  process.exit(1);
}
