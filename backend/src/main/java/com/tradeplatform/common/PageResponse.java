package com.tradeplatform.common;

import java.util.List;

import org.springframework.data.domain.Page;

// Spring's Page serializes with a lot of internal fields, so the API returns this instead.
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(page.getContent(), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages());
    }
}
