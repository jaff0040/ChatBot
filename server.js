// Import required modules
const express = require('express'); // Web application framework for Node.js
const http = require('http'); // Node.js built-in HTTP module
const axios = require('axios'); // Promise-based HTTP client
const socketIo = require('socket.io'); // Real-time bidirectional communication
const path = require('path'); // Path utility module for consistent file paths

// Initialize Express application
const app = express();

// Create an HTTP server using the Express app
const server = http.createServer(app);

// Initialize Socket.IO and attach it to the HTTP server
const io = socketIo(server);

// Serve static files from the 'public' directory
app.use(express.static(__dirname));

// Define the default route to serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Listen for new Socket.IO connections
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Listen for 'chat message' events from the client
  socket.on('chat message', async (msg) => {
    try {
      // Make a POST request to the AI server
      const response = await axios({
        method: 'post',
        url: 'http://127.0.0.1:1234/v1/chat/completions',
        data: {
          messages: [{ role: 'system', content: msg }],
          temperature: 0.7,
          max_tokens: -1,
          stream: true,
        },
        headers: { 'Content-Type': 'application/json' },
        responseType: 'stream',
      });

      let buffer = '';

      // Handle the incoming data stream
      response.data.on('data', (chunk) => {
        buffer += chunk.toString();

        while (buffer.includes('\n')) {
          const newlineIndex = buffer.indexOf('\n');
          let jsonStr = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (jsonStr.trim() !== '') {
            if (jsonStr.startsWith('data: ')) {
              jsonStr = jsonStr.slice('data: '.length);
            }

            if (jsonStr.trim() === '[DONE]') {
              socket.emit('chat message', {
                role: 'system',
                content: 'AI: Response finished.',
              });
              continue;
            }

            try {
              const data = JSON.parse(jsonStr);
              if (
                data.choices &&
                data.choices[0] &&
                data.choices[0].delta &&
                data.choices[0].delta.content
              ) {
                socket.emit('chat message', {
                  role: 'assistant',
                  content: data.choices[0].delta.content,
                });
              }
            } catch (error) {
              console.error('Error parsing JSON:', error.message);
            }
          }
        }
      });

      // Handle the end of the data stream
      response.data.on('end', () => {
        socket.emit('chat message', {
          role: 'system',
          content: 'AI: Response finished.',
        });
      });
    } catch (error) {
      console.error('Error during AI communication:', error.message);
      socket.emit('chat message', {
        role: 'assistant',
        content: 'AI: An error occurred while trying to communicate with the AI server.',
      });
    }
  });

  // Handle client disconnections
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Set the port for the server
const PORT = process.env.PORT || 3000;

// Start the server
server.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
