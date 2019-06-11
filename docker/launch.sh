docker-compose down -v
(cd .. && docker build -t reportprovider:test .)
docker-compose up -d
docker-compose logs -f
