const https = require('https');

async function testWithHttps() {
    const apiKey = 'pst-Nv7YbTZUu1v4M0ZktYEvZBSwfJTvmpqkS52FkGUVXkCrUqzEm6rd1Ch2GCTFzVRI';

    const payload = JSON.stringify({
        input: "masterpiece, best quality, 1girl",
        model: "nai-diffusion-3",
        action: "generate",
        parameters: {
            width: 832,
            height: 1216,
            scale: 5,
            sampler: "k_euler",
            steps: 28,
            n_samples: 1,
            ucPreset: 3,
            sm: true,
            dynamic_thresholding: true,
            cfg_rescale: 0.18,
            noise_schedule: "native",
            negative_prompt: "lowres, bad",
            seed: 12345,
            sm_dyn: true
        }
    });

    console.log('Sending with https module...');
    console.log('Payload length:', payload.length);

    const options = {
        hostname: 'image.novelai.net',
        port: 443,
        path: '/ai/generate-image',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            console.log('Response status:', res.statusCode);
            console.log('Response headers:', res.headers);

            let data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(data);
                console.log('Response size:', buffer.length, 'bytes');
                if (res.statusCode !== 200) {
                    console.log('Error body:', buffer.toString());
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error('Request error:', e);
            reject(e);
        });

        req.write(payload);
        req.end();
    });
}

testWithHttps();
