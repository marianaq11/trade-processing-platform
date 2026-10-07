# Build the jar with the Maven wrapper, then run it on a JRE-only image.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Dependencies first, so they're cached unless pom.xml changes.
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -ntp dependency:go-offline

# Tests are skipped here because they start their own Postgres with Testcontainers, which
# needs Docker. CI runs them.
COPY src src
RUN ./mvnw -B -ntp package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --no-create-home app
COPY --from=build /app/target/trade-platform-*.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
