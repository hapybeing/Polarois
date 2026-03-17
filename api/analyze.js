export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { image } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'System error: API Key not configured.' });
        }

        if (!image) {
            return res.status(400).json({ error: 'No image data provided.' });
        }

        const base64Data = image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
        const mimeTypeMatch = image.match(/^data:(image\/(png|jpeg|jpg|webp));base64,/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

        // FIXED: Updated to the correct Gemini 2.5 Flash endpoint
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [
                    {
                        text: "Act as a world-class curator and master photographer. Critique the provided image. Respond ONLY with raw JSON. Do not include markdown formatting, backticks, or code blocks. The JSON must have exactly these keys: 'composition', 'lighting', 'mood', 'narrative', 'technical'. Provide a detailed, insightful evaluation string for each key."
                    },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.3,
                response_mime_type: "application/json"
            }
        };

        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upstream API Error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No analysis generated.');
        }

        const rawText = data.candidates[0].content.parts[0].text.trim();
        
        let parsedResult;
        try {
            parsedResult = JSON.parse(rawText);
        } catch (e) {
            const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedResult = JSON.parse(cleanedText);
        }

        return res.status(200).json(parsedResult);
        
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Failed to analyze image.' });
    }
}
