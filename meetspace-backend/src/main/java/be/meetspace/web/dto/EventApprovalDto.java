package be.meetspace.web.dto;

public class EventApprovalDto {
    
    private boolean approved;
    private String rejectionReason;

    public boolean isApproved() { return approved; }
    public void setApproved(boolean approved) { this.approved = approved; }

    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
}

