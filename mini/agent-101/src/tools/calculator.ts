// 一个最小工具：两数运算。
// 故意只支持两数 + - * /，是为了「逼」LLM 在复杂表达式时多次调用工具，
// 这样你才能在 L3 里看到 agent 循环真的在循环。

export type Op = "+" | "-" | "*" | "/";

export interface CalcArgs {
  a: number;
  b: number;
  op: Op;
}

export function calculator({ a, b, op }: CalcArgs): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/":
      if (b === 0) throw new Error("除零错误");
      return a / b;
  }
}

// 这是「工具暴露给 LLM」时用的 JSON Schema。
// LLM 看的就是这个 schema 来决定何时/怎么调你。
// 注意：description 写得越准，LLM 调得越准。
export const calculatorSchema = {
  type: "function" as const,
  function: {
    name: "calculator",
    description:
      "对两个数字做一次基础四则运算。复杂表达式需要分多步调用本工具。",
    parameters: {
      type: "object",
      properties: {
        a: { type: "number", description: "第一个操作数" },
        b: { type: "number", description: "第二个操作数" },
        op: {
          type: "string",
          enum: ["+", "-", "*", "/"],
          description: "运算符",
        },
      },
      required: ["a", "b", "op"],
    },
  },
};
