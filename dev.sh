docker volume rm $(docker volume ls -qf dangling=true)
docker stop $(docker ps -a -q)

docker rm $(docker ps -a -q)

# docker volume ls

docker-compose -f docker-compose.dev.yml up --build
