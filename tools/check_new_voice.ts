const CARTESIA_KEY = process.env.CARTESIA_API_KEY || ''

async function checkVoice() {
  const res = await fetch('https://api.cartesia.ai/voices/3597a26f-80ef-4bd5-8101-9699bc764917', {
    headers: { 'X-API-Key': CARTESIA_KEY, 'Cartesia-Version': '2024-06-10' }
  })
  console.log('Voice info for 3597a26f-80ef-4bd5-8101-9699bc764917:', await res.json())
}
checkVoice().catch(console.error)
