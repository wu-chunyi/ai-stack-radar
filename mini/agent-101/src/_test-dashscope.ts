/**
 * 测试阿里百炼 embedding API
 */
import "dotenv/config";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

async function main() {
  try {
    const res = await client.embeddings.create({
      model: "text-embedding-v3",
      input: ["Phase 4 有几个 issue", "ROADMAP 路线图规划"],
    });
    console.log("✅ 阿里百炼 embedding 可用");
    console.log("维度:", res.data[0]?.embedding.length);
    console.log("前 5 维:", res.data[0]?.embedding.slice(0, 5));
    console.log("返回了", res.data.length, "个向量");
  } catch (err) {
    console.log("❌", (err as Error).message);
  }
}
main();
