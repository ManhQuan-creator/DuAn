package org.example.oracleconnectionpool.service.base;

import org.example.oracleconnectionpool.constant.CommonResponseCode;
import org.example.oracleconnectionpool.exceptions.NotFoundException;
import org.example.oracleconnectionpool.repository.base.BaseJpaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Collection;
import java.util.LinkedList;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Supplier;

public abstract class BaseJpaService<E, ID, R extends BaseJpaRepository<E, ID>> {
    protected final R      repo;
    protected final Logger log = LoggerFactory.getLogger(this.getClass());

    protected BaseJpaService(R repo) {
        this.repo = repo;
    }

    public E save(E entity) {
        return (E)this.repo.save(entity);
    }

    public E saveAndFlush(E entity) {
        return (E)this.repo.saveAndFlush(entity);
    }

    public List<E> saveAll(Collection<E> entities) {
        return this.repo.saveAll(entities);
    }

    public Optional<E> get(ID id) {
        return this.repo.findById(id);
    }

    public <X extends Throwable> E findByIdMandatory(ID id, Supplier<? extends X> exSupplier) throws X {
        return (E)this.get(id).orElseThrow(exSupplier);
    }

    public E getOrElseThrow(ID id) {
        return (E)this.get(id).orElseThrow(() -> {
            CommonResponseCode var10002 = CommonResponseCode.NOT_EXISTED;
//            String var10003 = MessageUtils.get(CommonResponseCode.NOT_EXISTED.getMessageKey(), new Object[0]);
            throw new RuntimeException(var10002 + ": " + String.valueOf(id));
        });
    }

    public E delete(E entity) {
        this.repo.delete(entity);
        return entity;
    }

    public void deleteAllInBatch(Iterable<E> entity) {
        this.repo.deleteAllInBatch(entity);
    }

    public void deleteAllByIdInBatch(Iterable<ID> entityIds) {
        this.repo.deleteAllByIdInBatch(entityIds);
    }

    public List<E> getAll() {
        return this.repo.findAll();
    }

    public E deleteIfExisted(ID id) {
        Optional<E> optional = this.get(id);
        if (optional.isPresent()) {
            E entity = (E)optional.get();
            return (E)this.delete(entity);
        } else {
            return null;
        }
    }

    public E updateOnField(ID id, Consumer<E> entityConsumer) {
        E entity = (E)this.getOrElseThrow(id);
        return (E)this.update(entity, entityConsumer);
    }

    public E update(E entity, Consumer<E> entityConsumer) {
        entityConsumer.accept(entity);
        return (E)this.save(entity);
    }

    public Page<E> query(int pageSize, int pageIndex) {
        int offset = (pageIndex - 1) * pageSize;
        PageRequest pageable = PageRequest.of(Math.max(offset, 0), pageSize);
        return this.repo.findAll(pageable);
    }

    public Page<E> query(Pageable pageable) {
        return this.repo.findAll(pageable);
    }

    public List<E> findAll(int pageSize, int pageIndex) {
        return this.findAll(getPageable(pageIndex, pageSize));
    }

    public List<E> findAll(Pageable pageable) {
        List<E> results = new LinkedList();

        Pageable nextPageable;
        for(Page<E> page = this.query(pageable); page.hasContent(); page = this.query(nextPageable)) {
            results.addAll(page.getContent());
            nextPageable = page.getPageable().next();
        }

        return results;
    }

    public List<E> findAllById(Iterable<ID> ids) {
        return this.repo.findAllById(ids);
    }

    public boolean existById(ID id) {
        return this.repo.existsById(id);
    }

    public void existByIdOrElseThrow(ID id) {
        boolean exist = this.repo.existsById(id);
        if (!exist) {
            CommonResponseCode var10002 = CommonResponseCode.NOT_EXISTED;
//            String var10003 = MessageUtils.get(CommonResponseCode.NOT_EXISTED.getMessageKey(), new Object[0]);
            throw new NotFoundException(var10002.getMessageKey() + ": " + String.valueOf(id));
        }
    }

    public void saveAllAndFlush(Iterable<E> entities) {
        this.repo.saveAllAndFlush(entities);
    }

    public static Pageable getPageable(int pageIndex, int pageSize) {
        return PageRequest.of(Math.max(pageIndex - 1, 0), pageSize);
    }

    public static Pageable getPageable(int pageIndex, int pageSize, Sort sort) {
        return PageRequest.of(Math.max(pageIndex - 1, 0), pageSize, sort);
    }
}