const CARTESIA_KEY = process.env.CARTESIA_API_KEY || ''

async function checkLaura() {
  const res = await fetch('https://api.cartesia.ai/voices/1cc00672-e9d4-455e-b3fb-31dfb7aad231', {
    headers: { 'X-API-Key': CARTESIA_KEY, 'Cartesia-Version': '2024-06-10' }
  })
  console.log('Voice info for 1cc00672-e9d4-455e-b3fb-31dfb7aad231:', await res.json())
}
checkLaura().catch(console.error)
