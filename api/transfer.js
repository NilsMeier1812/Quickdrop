import { Redis } from '@upstash/redis';

// Verbindet sich automatisch mit der Datenbank über Vercel Environment Variables
const redis = Redis.fromEnv();

// Wie lange (in Sekunden) sollen die Dateien im Arbeitsspeicher überleben?
// 300 Sekunden (5 Minuten) ist sicher genug für den Transfer.
const TTL = 300; 

export default async function handler(req, res) {
    // Sicherheits-Kopfzeilen (CORS), damit dein Frontend mit dieser API sprechen darf
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // "Preflight" Anfrage des Browsers abfangen
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Wir lesen aus der URL aus, was genau das Frontend von uns will
    const { action, sessionId, chunkIndex } = req.query;

    try {
        // ==========================================
        // POST: SENDER LÄDT HOCH (PC -> Server)
        // ==========================================
        if (req.method === 'POST') {
            
            // 1. Metadaten (Dateiname, Größe, Anzahl der Stücke) speichern
            if (action === 'meta') {
                const metadata = req.body;
                // Speichere in Redis unter dem Schlüssel: session:123:meta
                await redis.set(`session:${sessionId}:meta`, JSON.stringify(metadata), { ex: TTL });
                return res.status(200).json({ success: true });
            }

            // 2. Ein einzelnes Datenstück (500 KB) speichern
            if (action === 'chunk') {
                const { data } = req.body;
                // Speichere in Redis unter dem Schlüssel: session:123:chunk:0
                await redis.set(`session:${sessionId}:chunk:${chunkIndex}`, data, { ex: TTL });
                return res.status(200).json({ success: true });
            }
        }

        // ==========================================
        // GET: EMPFÄNGER LÄDT HERUNTER (Server -> Handy)
        // ==========================================
        if (req.method === 'GET') {
            
            // 1. Prüfen: Gibt es für diese Session schon eine Datei?
            if (action === 'meta') {
                const meta = await redis.get(`session:${sessionId}:meta`);
                if (!meta) {
                    return res.status(404).json({ error: 'Noch keine Datei da' });
                }
                // Redis gibt oft ein fertiges Objekt zurück, zur Sicherheit parsen wir es aber
                const parsedMeta = typeof meta === 'string' ? JSON.parse(meta) : meta;
                return res.status(200).json(parsedMeta);
            }

            // 2. Ein spezifisches Datenstück herunterladen
            if (action === 'chunk') {
                const chunkData = await redis.get(`session:${sessionId}:chunk:${chunkIndex}`);
                if (!chunkData) {
                    return res.status(404).json({ error: 'Datenstück nicht gefunden' });
                }
                return res.status(200).json({ data: chunkData });
            }
        }

        // Fallback, falls eine falsche URL aufgerufen wurde
        return res.status(400).json({ error: 'Unbekannte Aktion' });

    } catch (error) {
        console.error('Redis Fehler:', error);
        return res.status(500).json({ error: 'Interner Server Fehler' });
    }
}
