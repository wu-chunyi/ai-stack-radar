import "dotenv/config";
import { jinaEmbed } from "./tools/embedding.js";

async function main() {
  try {
    const vecs = await jinaEmbed(["测试 Jina embedding 是否可用"]);
    console.log("✅ Jina embedding 可用");
    console.log("维度:", vecs[0]!.length);
    console.log("前 5 维:", vecs[0]!.slice(0, 5));
  } catch (err) {
    console.log("❌", (err as Error).message);
  }
}
main();
