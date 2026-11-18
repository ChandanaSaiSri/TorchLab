FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY content ./content
COPY challenges ./challenges
COPY assessments ./assessments
COPY projects ./projects
COPY schema.sql ./schema.sql
USER node
EXPOSE 4000
CMD ["node", "src/index.js"]
