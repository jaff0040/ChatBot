// Make the marked function available globally
window.marked = marked;
            
const socket = io();
// const form = document.getElementById('form');
//const input = document.getElementById('input-field');
// const button = form.querySelector('button'); // Get the button element
const messages = document.getElementById('messages');
const chatbot = document.getElementById('chatbot');
const conversation = document.getElementById('conversation');
const inputForm = document.getElementById('input-form');
const inputField = document.getElementById('input-field');
let lastItem = null;
let lastRole = null;

inputForm.addEventListener('submit', function(e) {
    // var markdownContent = '```javascript\nconsole.log("Hello, world!");\n```';
    // var renderedHTML = marked(markdownContent);
    // console.log(renderedHTML);

    e.preventDefault();
    if (inputField.value) {
        // Get user input
        const input = inputField.value;
        console.log(`User input: ${input}`);

        // Clear input field
        inputField.value = '';
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: "2-digit" });

        // Add user input to conversation
        let message = document.createElement('div');
        message.classList.add('chatbot-message', 'user-message');
        message.innerHTML = `<p class="chatbot-text" sentTime="${currentTime}">${input}</p>`;
        conversation.appendChild(message);

        console.log(`User input: ${input}`);
        socket.emit('chat message', input);
        //inputField = '';
        inputField.disabled = true; // Disable the input
        // button.disabled = true; // Disable the button
    }
});

let newResponse = true;

socket.on('chat message', function(msg) {
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: "2-digit" });
    if (msg.role === 'system' && msg.content === 'AI: Response finished.') { // If this is the end message
        inputField.disabled = false; // Enable the input
        // button.disabled = false; // button is no longer used. Remove this line
        newResponse = true; // Set the flag to true for the next response

        // Check if the last message contains markdown content
        var markdownRegex = /```[\s\S]*```/; // Regular expression to match markdown content
        var lastChatbotMessage = conversation.querySelector('.chatbot-message:last-child');
        var lastChatbotText = lastChatbotMessage.querySelector('.chatbot-text').textContent;

        if (markdownRegex.test(lastChatbotText)) {
            // This is markdown content
            var markdownContent = lastChatbotText.match(markdownRegex)[0]; // Extract the markdown content
            var renderedHTML = marked(markdownContent); // Render the markdown content to HTML

            console.log('Markdown content:', markdownContent); // Print the markdown content to the console
            console.log('Rendered HTML:', renderedHTML); // Print the rendered HTML to the console

            // Replace the markdown content in the last message with the rendered markdown content
            lastChatbotMessage.querySelector('.chatbot-text').innerHTML = lastChatbotMessage.querySelector('.chatbot-text').innerHTML.replace(markdownContent, renderedHTML);
        }

        return; // Don't create a new message
    }

    // Check if this is a new message by comparing roles or if it's a new assistant response
    if (lastRole !== msg.role || (lastRole === 'assistant' && msg.role === 'assistant' && newResponse)) {
        // Create a new container div (appears to be unused - might be removable)
        lastItem = document.createElement('div');
        conversation.appendChild(lastItem);

        // Create a new message div element
        message = document.createElement('div');
        // Add appropriate CSS classes based on whether it's an AI or user message
        message.classList.add('chatbot-message', msg.role === 'assistant' ? 'chatbot' : 'user-message');
        // Set the message content with timestamp, adding 'AI: ' prefix for assistant messages
        // Also removes any existing 'AI: ' prefix from the content to avoid duplication
        message.innerHTML = `<p class="chatbot-text" sentTime="${currentTime}">${msg.role === 'assistant' ? 'AI: ' : ''}${msg.content.replace(/^AI: /, '')}</p>`;
        // Add the message to the conversation
        conversation.appendChild(message);
        // Scroll the new message into view smoothly
        message.scrollIntoView({behavior: "smooth"});
        // Reset the newResponse flag since we've handled the start of the response
        newResponse = false;
    } else {
        // If this is a continuation of the previous message
        // Find the last message in the conversation
        const lastChatbotMessage = conversation.querySelector('.chatbot-message:last-child');
        // Append the new content to the existing message, removing any 'AI: ' prefix
        lastChatbotMessage.querySelector('.chatbot-text').innerHTML += msg.content.replace(/^AI: /, '');
    }

    // Store the current message role for the next comparison
    lastRole = msg.role;

    // Scroll the window to show the latest messages
    window.scrollTo(0, document.body.scrollHeight);
});