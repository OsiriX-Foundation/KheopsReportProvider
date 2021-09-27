docker-compose down -v
(cd .. && docker build -t reportprovidermove:test .)
docker-compose up -d
docker-compose logs -f
