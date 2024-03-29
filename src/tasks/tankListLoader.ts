import { clickhouse } from "@/db";
import { schedule } from "node-cron";

type ResponseData = {
  images: {
    big_icon: string
  },
  tag: string,
  name: string,
  short_name: string
  nation: string,
  type: string,
  tier: string
}

async function loadTankList() {
  const apiId = Bun.env.WG_API_KEY
  if (!apiId) throw new Error("API key is empty");

  const url = `https://api.tanki.su/wot/encyclopedia/vehicles/?application_id=${apiId}&fields=images.big_icon,name,tag,nation,tier,type,short_name`

  const startLoadingTime = performance.now()
  const response = await fetch(url)
  const body = await response.json()
  const loadingTime = performance.now() - startLoadingTime

  if (!body || typeof body !== 'object' || !('status' in body))
    throw new Error("Bad response\n" + JSON.stringify(body));

  if (body.status != 'ok')
    throw new Error("Not success\n" + JSON.stringify(body));

  if (!('data' in body) || !body.data || typeof body.data !== 'object')
    throw new Error("Has not data\n" + JSON.stringify(body));

  const values = Object.values<ResponseData>(body.data as any)
  const data = values.map(t => ({
    tag: `${t.nation}:${t.tag}`,
    type: t.type,
    level: t.tier,
    nation: t.nation,
    iconUrl: t.images.big_icon,
    nameRU: t.name,
    shortNameRU: t.short_name
  }))

  if (data.length < 100) throw new Error("Tank list to low\n" + JSON.stringify(data));

  console.log('SKIP INSERT');
  return;

  await clickhouse.insert({
    table: 'TankList',
    values: data,
    format: 'JSONEachRow'
  })

  await clickhouse.command({ query: 'alter table TankList delete where True', clickhouse_settings: { mutations_sync: '2' } })

  console.log(`Successfully load tank list: ${loadingTime} ms`);
}

export function start() {
  // loadTankList()

  schedule('0 3 * * *', async () => {
    let success = false
    for (let i = 0; i < 3 && !success; i++) {
      try {
        console.log(`Try load tank list: ${i}`);
        await loadTankList()
        success = true
      } catch (error) {
        console.error(error);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  });
}
