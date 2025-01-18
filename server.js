// Import required modules
const express = require('express');  // Web application framework for Node.js
const http = require('http');        // Node.js built-in HTTP module
const axios = require('axios');      // Promise based HTTP client for the browser and node.js
const socketIo = require('socket.io');  // Real-time bidirectional event-based communication

// Initialize Express application
const app = express();

// Create an HTTP server using the Express app
const server = http.createServer(app);

// Initialize Socket.IO and attach it to the HTTP server
const io = socketIo(server);

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Listen for new Socket.IO connections
io.on('connection', (socket) => {
    // Log when a new client connects, including their unique socket ID
    console.log('New client connected:', socket.id);

    // Listen for 'chat message' events from this specific client
    socket.on('chat message', async (msg) => {
        try {
            // Make a POST request to the AI completion API
            const response = await axios({
                method: 'post',
                url: 'http://127.0.0.1:1234/v1/chat/completions',
                data: {
                    // Configure the messages to send to the AI
                    messages: [
                        //{ "role": "system", "content": "Give me answers." }, user
                        { role: 'system', content: msg }
                    ],
                    temperature: 0.7,    // Controls randomness: 0.0 is deterministic, 1.0 is very random
                    max_tokens: -1,      // No limit on the number of tokens in the response
                    stream: true         // Enable streaming of the response
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                responseType: 'stream'   // Expect a stream response
            });

            // Buffer to accumulate incoming data
            let buffer = '';

            // Listen for data events on the response stream
            response.data.on('data', (chunk) => {
                console.log(chunk.toString());
                // Append the new chunk to the buffer
                buffer += chunk.toString();

                // Process complete JSON objects in the buffer
                while (buffer.includes('\n')) {
                    // Find the index of the first newline character in the buffer
                    const newlineIndex = buffer.indexOf('\n');
                    // Extract the substring from the buffer up to the newline index
                    let jsonStr = buffer.slice(0, newlineIndex);
                    // Update the buffer to remove the processed part (up to and including the newline)
                    buffer = buffer.slice(newlineIndex + 1);

                    // Check if the extracted string is not just whitespace
                    if (jsonStr.trim() !== '') {
                        // Remove the "data: " prefix if it exists in the JSON string
                        if (jsonStr.startsWith('data: ')) {
                            jsonStr = jsonStr.slice('data: '.length);
                        }

                        // Check if the JSON string indicates that the response is complete
                        if (jsonStr.trim() === '[DONE]') {
                            // Emit a 'chat message' event to the client indicating that the AI response has finished
                            socket.emit('chat message', { role: 'system', content: 'AI: Response finished.' });
                            // Continue to the next iteration of the loop to process any remaining data
                            continue;
                        }

                        try {
                            // Parse the JSON string
                            const data = JSON.parse(jsonStr);
                            // Check if the parsed data contains a new content chunk
                            if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
                                // Emit the new content chunk to the specific client
                                socket.emit('chat message', {
                                    // Set the role of the message to 'assistant' indicating it's from the AI
                                    role: 'assistant',
                                    // Set the content of the message to the current chunk of data received from the AI
                                    content: data.choices[0].delta.content,
                                     // Determine if this is the last chunk of the response
                                    // 'isLastChunk' is true if the finish_reason indicates the response has completed
                                    isLastChunk: data.choices[0].delta.finish_reason === 'stop'
                                });
                            }
                        } catch (error) {
                            // Log any JSON parsing errors
                            console.error('Error parsing JSON:', error);
                        }
                    }
                }
            });

            // Listen for the end of the response stream
            response.data.on('end', () => {
                // Notify the client that the AI's response has finished
                socket.emit('chat message', { role: 'system', content: 'AI: Response finished.' });
            });
        } catch (error) {
            // Log any errors that occur during the API request or processing
            console.error('Error:', error.message);
            // Notify the client of the error
            socket.emit('chat message', { role: 'assistant', content: 'AI: An error occurred while trying to communicate with the AI server.' });
        }
    });

    // Listen for disconnect events from this client
    socket.on('disconnect', () => {
        // Log when a client disconnects
        console.log('Client disconnected:', socket.id);
    });
});

// Set the port for the server to listen on
const port = 3000;

// Start the server
server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});