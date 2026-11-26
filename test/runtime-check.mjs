import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as miniflare from 'miniflare'
import { build } from 'esbuild'

test('workerd SQLite: concurrent reservation, rejected delivery and independent probe ledger', async () => {
  const {outputFiles} = await build({entryPoints:['worker/index.mjs'],bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers']})
  let accepted = 0
  let upstreamStatus = 200
  const options = {workers:[{
    name:'test',modules:true,script:outputFiles[0].text,compatibilityDate:'2026-11-24',
    durableObjects:{SENDER:{className:'Sender',useSQLite:true}},
    bindings:{ADMIN_TOKEN:'test-admin',NTFY_TOPIC:'test-topic-123456789',MEALS_URL:'https://example.org/meals'},
    outboundService:async request=>{
      if(new URL(request.url).hostname==='ntfy.sh'){
        const body=await request.json()
        assert.equal(body.priority,4)
        accepted++
        return Response.json({id:'mock'}, {status:upstreamStatus})
      }
      const date=new Date(Date.now()+9*3600000).toISOString().slice(0,10)
      return Response.json({[date]:{breakfast:['rice'],lunch:['rice'],dinner:['rice']}})
    },
  }]}
  const mf = new miniflare.Miniflare(miniflare.convertV4MiniflareOptions ? miniflare.convertV4MiniflareOptions(options) : options)
  const call = async body => {
    const response=await mf.dispatchFetch('https://test',{method:'POST',headers:{Authorization:'Bearer test-admin','Content-Type':'application/json'},body:JSON.stringify(body)})
    return {status:response.status, body:await response.json()}
  }
  try {
    const results=await Promise.all(Array.from({length:10},()=>call({meal:'breakfast',dryRun:false})))
    assert.equal(results.filter(x=>x.body.status==='accepted').length,1)
    assert.equal(results.filter(x=>x.body.status==='duplicate').length,9)
    assert.equal(accepted,1)
    upstreamStatus=429
    const rejected=await call({meal:'dinner',dryRun:false})
    assert.equal(rejected.status,502)
    assert.equal(rejected.body.stage,'ntfy-http')
    const record=await call({meal:'dinner',inspect:true})
    assert.equal(record.body.record.status,'rejected')
    assert.equal(record.body.record.upstreamStatus,429)
    upstreamStatus=200
    assert.equal((await call({meal:'dinner',dryRun:false})).body.status,'duplicate')
    assert.equal((await call({meal:'dinner',dryRun:false,probe:true})).body.status,'accepted')
    assert.equal((await call({meal:'dinner',dryRun:false,probe:true})).body.status,'duplicate')
    assert.deepEqual((await call({meal:'dinner',inspect:true})).body,record.body)
    assert.equal(accepted,3)
  } finally { await mf.dispose() }
})
