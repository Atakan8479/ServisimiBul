package com.servisimibul.backend.identity;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {

    Optional<AppUser> findByEmail(String email);

    long countByRole(UserRole role);

    @Query("""
            select user.id
            from AppUser user
            where user.role = com.servisimibul.backend.identity.UserRole.ADMIN
              and user.enabled = true
              and user.emailVerifiedAt is not null
            order by user.id
            """)
    List<UUID> findEnabledVerifiedAdminIds();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select user from AppUser user where user.email = :email")
    Optional<AppUser> findByEmailForUpdate(@Param("email") String email);
}
