package be.meetspace.web.dto;

public class AuthResponseDto {

    private String token;
    private UserResponseDto user;

    public AuthResponseDto(String token, UserResponseDto user) {
        this.token = token;
        this.user = user;
    }

    public String getToken() { return token; }
    public UserResponseDto getUser() { return user; }
}

