package com.example;

import com.ultikits.ultitools.abstracts.Base;
import com.ultikits.ultitools.interfaces.Operator;
import com.ultikits.ultitools.interfaces.SubOperator;

// Every call below resolves at run time against the full fixture framework.
// The java.lang.Object methods called through an interface type are the
// shape symcheck.py once reported as missing (JVMS 5.4.3.4 falls back to
// Object's public methods for interface method resolution).
public class Mod extends Base implements Cloneable {
    public void run(Operator<String> op, SubOperator sub) throws Exception {
        op.getClass();
        op.hashCode();
        op.equals(sub);
        op.toString();
        op.notifyAll();
        sub.getClass();
        sub.get();
        op.removable();
        hello();
        hashCode();
        getClass();
        super.clone();
    }
}
