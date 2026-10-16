package com.servisimibul.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class SessionCleanupOperationsTests {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void batchedCleanupDeletesOnlyExpiredSessionsAndCascadesAttributes() {
        long now = System.currentTimeMillis();
        String expiredPrimaryId = UUID.randomUUID().toString();
        String activePrimaryId = UUID.randomUUID().toString();

        insertSession(expiredPrimaryId, now - 1_000);
        insertSession(activePrimaryId, now + 60_000);
        insertAttribute(expiredPrimaryId);
        insertAttribute(activePrimaryId);

        int deleted = jdbcTemplate.update("""
                with expired_batch as (
                    select primary_id
                    from spring_session
                    where expiry_time < ?
                    order by expiry_time
                    limit 1000
                    for update skip locked
                )
                delete from spring_session session_row
                using expired_batch
                where session_row.primary_id = expired_batch.primary_id
                """, now);

        assertThat(deleted).isOne();
        assertThat(sessionCount(expiredPrimaryId)).isZero();
        assertThat(attributeCount(expiredPrimaryId)).isZero();
        assertThat(sessionCount(activePrimaryId)).isOne();
        assertThat(attributeCount(activePrimaryId)).isOne();
    }

    private void insertSession(String primaryId, long expiryTime) {
        jdbcTemplate.update("""
                insert into spring_session (
                    primary_id, session_id, creation_time, last_access_time,
                    max_inactive_interval, expiry_time, principal_name
                ) values (?, ?, ?, ?, ?, ?, ?)
                """, primaryId, UUID.randomUUID().toString(), expiryTime - 60_000,
                expiryTime - 30_000, 1_800, expiryTime, "a09@example.test");
    }

    private void insertAttribute(String primaryId) {
        jdbcTemplate.update("""
                insert into spring_session_attributes (
                    session_primary_id, attribute_name, attribute_bytes
                ) values (?, ?, ?)
                """, primaryId, "A09_TEST", new byte[]{1});
    }

    private int sessionCount(String primaryId) {
        return jdbcTemplate.queryForObject(
                "select count(*) from spring_session where primary_id = ?",
                Integer.class,
                primaryId
        );
    }

    private int attributeCount(String primaryId) {
        return jdbcTemplate.queryForObject(
                "select count(*) from spring_session_attributes where session_primary_id = ?",
                Integer.class,
                primaryId
        );
    }
}
