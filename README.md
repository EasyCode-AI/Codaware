<h1 align="center"><br>Codaware - by EasyCode<br></h1>

## Chat with Codebase from ChatGPT or Claude.ai

[![Codaware Demo](https://img.youtube.com/vi/WFo2guwa8bY/maxresdefault.jpg)](https://youtu.be/WFo2guwa8bY)

- no more copying & pasting
- don't pay for multiple subscriptions, use chatgpt plus or claude paid plan, and advanced models
- take advantage of web features such as o1-preview, image, web search, artifacts, etc.

## Features
- [x] reference files on ChatGPT & Claude.ai
- [x] ability to apply changes directly from ChatGPT and Claude.ai

## Bugs
- [x] hitting ENTER sends question without injecting file content [Medium]
- [x] Error loading files sometimes
- [x] socket error sometimes [Tiny]
- [x] prevent duplicated files from being added.  [Tiny]

## Improvements
- [x] refactor front end into more modular components [Medium]
  - [ ] migrate project to react or nextjs [Medium]
  - [ ] add bundling 
- [x] add a file name place holder after the file is injected [tiny]
- [x] refactor vscode side to its own folder and make it modular as well, 
- [x] stop generation doesn't work due to capturing the button submit [Medium?]
- [ ] collapse the codeblocks in the "sent" sections [Tiny/Easy]
- [ ] don't resend file content its already in chat context [Tiny]

## Future Feature Ideas
- [ ] ability to @problems inside chrome extension
- [ ] ability to @codebase and RAG the codebase
- [ ] [WIP] add ability to drag a folder and parse the file path, and fetch the files.. [Medium]
- [ ] send file updates from vscode to browser.
- [ ] compare answer with different models such as DeepSeek, Qwen, Llama 3, etc. [Hard]
- [ ] add ability to watch for errors in console, auto suggest it in the web browser [Medium?]

## Bugs or Feature Ideas
- Please submit a issue. 