package be.meetspace.web.dto;

import be.meetspace.entity.Role;

public class UpdateUserRoleRequest {
    private Role role;

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }
}

