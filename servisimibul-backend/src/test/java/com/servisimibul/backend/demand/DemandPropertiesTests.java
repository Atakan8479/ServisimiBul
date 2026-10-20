package com.servisimibul.backend.demand;

import com.servisimibul.backend.demand.config.DemandProperties;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DemandPropertiesTests {

    @Test
    void acceptsOnlyConsecutiveAcademicYears() {
        assertThat(new DemandProperties("2026-2027").academicYear()).isEqualTo("2026-2027");
        assertThatThrownBy(() -> new DemandProperties("2026-2028"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new DemandProperties("2026/2027"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
