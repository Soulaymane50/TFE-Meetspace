package be.meetspace.web.dto;

import jakarta.validation.constraints.NotNull;

public class ReservationApprovalRequest {

    @NotNull
    private Boolean approved;

    private String rejectionReason;

    public Boolean getApproved() { return approved; }
    public void setApproved(Boolean approved) { this.approved = approved; }

    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
}

