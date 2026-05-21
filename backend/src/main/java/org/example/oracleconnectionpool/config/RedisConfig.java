package org.example.oracleconnectionpool.config;

import org.example.oracleconnectionpool.service.NotificationService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import lombok.extern.slf4j.Slf4j;

@Configuration
@Slf4j
public class RedisConfig {
  @Bean
public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
    RedisTemplate<String, Object> template = new RedisTemplate<>();
    template.setConnectionFactory(connectionFactory);

    // 1. Khởi tạo ObjectMapper và đăng ký JavaTimeModule
    ObjectMapper mapper = new ObjectMapper();
    mapper.registerModule(new JavaTimeModule());
    // Ép Jackson ghi ngày tháng theo định dạng String ISO (ví dụ: "2026-02-06T16:40:00") 
    // thay vì mảng số [2026, 2, 6, ...]
    mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    // 2. Tạo Serializer với ObjectMapper đã cấu hình
    // Trong Spring Boot 3.x, đây là cách tốt nhất
    Jackson2JsonRedisSerializer<Object> serializer = new Jackson2JsonRedisSerializer<>(mapper, Object.class);

    // 3. Thiết lập Serializer cho Template
    template.setKeySerializer(new StringRedisSerializer());
    template.setValueSerializer(serializer);
    template.setHashKeySerializer(new StringRedisSerializer());
    template.setHashValueSerializer(serializer);

    template.afterPropertiesSet();
    return template;
}
    @Bean
    RedisMessageListenerContainer container(RedisConnectionFactory connectionFactory,
                                            MessageListenerAdapter listenerAdapter) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        
        // NODE chỉ nghe tin nhắn dành riêng cho mình
        String myTopic = NotificationService.NODE_TOPIC_PREFIX + NotificationService.NODE_ID;
        container.addMessageListener(listenerAdapter, new PatternTopic(myTopic));
        
        log.info("*************** Node subscribed to topic: {}", myTopic);
        return container;
    }

    @Bean
    MessageListenerAdapter listenerAdapter(RedisReceiver receiver) {
        return new MessageListenerAdapter(receiver, "receiveMessage");
    }
    
}