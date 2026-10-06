package com.tradeplatform.security;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Login and logout themselves are handled by Spring Security filters (see SecurityConfig).
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @GetMapping("/me")
    public CurrentUserResponse currentUser(Authentication authentication) {
        return new CurrentUserResponse(authentication.getName(), Roles.of(authentication));
    }

    public record CurrentUserResponse(String username, Role role) {
    }
}
