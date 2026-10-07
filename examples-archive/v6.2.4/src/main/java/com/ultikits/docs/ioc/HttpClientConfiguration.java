package com.ultikits.docs.ioc;

import com.ultikits.ultitools.annotations.Bean;
import com.ultikits.ultitools.annotations.Configuration;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import javax.sql.DataSource;
import java.net.http.HttpClient;
import java.time.Duration;

@Configuration
public class HttpClientConfiguration {

    @Bean
    public HttpClient createHttpClient() {
        // This method's return value becomes a managed bean
        return HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .version(HttpClient.Version.HTTP_2)
            .build();
    }

    @Bean(name = "primaryDatabase")
    public DataSource createDataSource() {
        // Named bean - useful when multiple beans of same type exist
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:mysql://localhost:3306/db");
        config.setUsername("user");
        config.setPassword("pass");
        return new HikariDataSource(config);
    }
}
