const CARTESIA_KEY = process.env.CARTESIA_API_KEY || ''

async function checkSpecificVoice() {
  const res = await fetch('https://api.cartesia.ai/voices/615e09e3-99ec-4ea8-b2ae-86b07c2961da', {
    headers: { 'X-API-Key': CARTESIA_KEY, 'Cartesia-Version': '2024-06-10' }
  })
  console.log('Voice info:', await res.json())
}
checkSpecificVoice().catch(console.error)
