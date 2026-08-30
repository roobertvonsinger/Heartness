const CARTESIA_KEY = process.env.CARTESIA_API_KEY || ''

async function listCartesiaVoices() {
  console.log('Fetching voices from Cartesia API...')
  const response = await fetch('https://api.cartesia.ai/voices', {
    headers: {
      'X-API-Key': CARTESIA_KEY,
      'Cartesia-Version': '2024-06-10',
    },
  })

  console.log('Status:', response.status)
  if (!response.ok) {
    console.error('Error:', await response.text())
    return
  }

  const voices = await response.json()
  console.log(`Total voices found: ${voices.length}`)

  const spanishVoices = voices.filter((v: any) =>
    v.language === 'es' ||
    (v.name && (v.name.toLowerCase().includes('spanish') || v.name.toLowerCase().includes('laura') || v.name.toLowerCase().includes('mexican') || v.name.toLowerCase().includes('es-')))
  )

  console.log('\n--- Spanish & Notable Cartesia Voices ---')
  for (const v of spanishVoices) {
    console.log(`ID: ${v.id} | Name: ${v.name} | Language: ${v.language} | Gender: ${v.gender || 'N/A'} | Description: ${v.description || ''}`)
  }

  console.log('\n--- Cloned / Custom Voices on this Account ---')
  const customVoices = voices.filter((v: any) => v.is_owner || v.user_id)
  for (const v of customVoices) {
    console.log(`ID: ${v.id} | Name: ${v.name} | Language: ${v.language} | Description: ${v.description || ''}`)
  }

  console.log('\n--- First 15 Public Voices ---')
  for (const v of voices.slice(0, 15)) {
    console.log(`ID: ${v.id} | Name: ${v.name} | Language: ${v.language} | Description: ${v.description || ''}`)
  }
}

listCartesiaVoices().catch(console.error)
