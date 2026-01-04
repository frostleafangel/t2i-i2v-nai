const fetch = require('node-fetch');

async function testNovelAI() {
    const apiKey = 'pst-Nv7YbTZUu1v4M0ZktYEvZBSwfJTvmpqkS52FkGUVXkCrUqzEm6rd1Ch2GCTFzVRI';

    const payload = {
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
    };

    console.log('Sending payload:', JSON.stringify(payload, null, 2));

    try {
        const response = await fetch('https://image.novelai.net/ai/generate-image', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers.raw());

        if (!response.ok) {
            const text = await response.text();
            console.log('Error response:', text);
        } else {
            console.log('SUCCESS! Got', response.headers.get('content-type'));
            const data = await response.arrayBuffer();
            console.log('Response size:', data.byteLength, 'bytes');
        }
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testNovelAI();
