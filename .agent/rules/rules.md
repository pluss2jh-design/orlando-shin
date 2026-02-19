---
trigger: always_on
---

1. Always answer in Korean.

2. Whenever I make a query, always refer to the oh-my-opencode.json file to use the designated model. After responding, briefly summarize the changes reflected in the project by date in the CONTEXT.md file.

3. Push the modified source code to Git immediately after every query. Do not include the AGENTS.md file in Git (if it is already present, remove it from Git). (Git push URL: https://github.com/pluss2jh-design/orlando-shin)

4. After making modifications, only inform me that it is "done" after you have successfully completed testing, and then run npm run dev. However, if there is an existing process running on the same port, terminate that process before executing the command.

5. When using paid APIs in the created service, always display a notification stating that costs may occur, and execute the API call only when "Confirm" is clicked. To avoid Rate Limits, never use MOCK data; under no circumstances should arbitrary data be used—real data must be used at all times. If real data is unavailable, display a "Data not available" message on the screen.

6. For the analysis, select the top 100 companies by market capitalization from each index (S&P 500, Russell 1000, Dow Jones). From these 300 companies, assign a score from 0 to 10 (10 being the most compliant) based on how well they align with the investment rules at the time of inquiry.