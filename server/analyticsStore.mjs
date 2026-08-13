import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const emptyData = () => ({ visitors: {}, totalVisits: 0 })

export function createAnalyticsStore(filePath) {
  let writes = Promise.resolve()

  async function readData() {
    try {
      const value = JSON.parse(await readFile(filePath, 'utf8'))
      return value && typeof value === 'object' && value.visitors ? value : emptyData()
    } catch (error) {
      if (error?.code === 'ENOENT' || error instanceof SyntaxError) return emptyData()
      throw error
    }
  }

  async function writeData(value) {
    await mkdir(path.dirname(filePath), { recursive: true })
    const temporaryPath = `${filePath}.${process.pid}.tmp`
    await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8')
    await rename(temporaryPath, filePath)
  }

  function recordVisit(visitorId, timestamp = Date.now()) {
    if (typeof visitorId !== 'string' || visitorId.length < 8 || visitorId.length > 200) {
      return Promise.reject(new Error('Identificador de visitante inválido.'))
    }
    writes = writes.then(async () => {
      const data = await readData()
      const current = data.visitors[visitorId]
      data.visitors[visitorId] = {
        firstSeen: current?.firstSeen ?? timestamp,
        lastSeen: timestamp,
        visits: (current?.visits ?? 0) + 1,
      }
      data.totalVisits = (data.totalVisits ?? 0) + 1
      await writeData(data)
      return summaryFrom(data)
    })
    return writes
  }

  async function getSummary() {
    await writes
    return summaryFrom(await readData())
  }

  return { getSummary, recordVisit }
}

function summaryFrom(data) {
  const visitors = Object.values(data.visitors)
  const lastVisit = visitors.reduce((latest, visitor) => Math.max(latest, visitor.lastSeen ?? 0), 0)
  return {
    uniqueVisitors: visitors.length,
    totalVisits: data.totalVisits ?? 0,
    lastVisit: lastVisit || null,
  }
}
