package be.meetspace.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class EventWaitlistRequest {

    @NotNull
    @Min(1)
    @Max(20)
    private Integer participantCount;

    public Integer getParticipantCount() { return participantCount; }
    public void setParticipantCount(Integer participantCount) { this.participantCount = participantCount; }
}
