/**
 * 测试 DeepSeek embedding endpoint 是否可用
 */
import { llm } from "./llm.js";

async function main() {
  try {
    const res = await llm.embeddings.create({
      model: "deepseek-embedding",
      input: "测试一下 embedding 是否可用",
    });
    console.log("✅ DeepSeek embedding 可用");
    console.log("维度:", res.data[0]?.embedding.length);
    console.log("前 5 维:", res.data[0]?.embedding.slice(0, 5));
  } catch (err) {
    console.log("❌ DeepSeek embedding 不可用:", (err as Error).message);
  }
}
main();
