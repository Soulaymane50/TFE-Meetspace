package be.meetspace.web.dto;

import java.time.LocalDate;
import java.util.List;

public record FinanceTrendDto(
        LocalDate from,
        LocalDate to,
        String granularity,
        List<FinanceTrendPointDto> points
) {}
