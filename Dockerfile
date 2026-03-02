FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY . .

RUN npm run build:widget

RUN mkdir -p data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:./data/changelog.db

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && npm run build && npm run start"]
