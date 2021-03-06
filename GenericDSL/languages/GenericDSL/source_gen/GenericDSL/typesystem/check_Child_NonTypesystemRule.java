package GenericDSL.typesystem;

/*Generated by MPS */

import jetbrains.mps.lang.typesystem.runtime.AbstractNonTypesystemRule_Runtime;
import jetbrains.mps.lang.typesystem.runtime.NonTypesystemRule_Runtime;
import org.jetbrains.mps.openapi.model.SNode;
import jetbrains.mps.typesystem.inference.TypeCheckingContext;
import jetbrains.mps.lang.typesystem.runtime.IsApplicableStatus;
import jetbrains.mps.lang.smodel.generator.smodelAdapter.SNodeOperations;
import org.jetbrains.mps.openapi.language.SAbstractConcept;
import jetbrains.mps.internal.collections.runtime.Sequence;
import jetbrains.mps.internal.collections.runtime.IWhereFilter;
import java.util.Objects;
import jetbrains.mps.lang.smodel.generator.smodelAdapter.SPropertyOperations;
import jetbrains.mps.errors.messageTargets.MessageTarget;
import jetbrains.mps.errors.messageTargets.NodeMessageTarget;
import jetbrains.mps.errors.IErrorReporter;
import org.jetbrains.mps.openapi.language.SConcept;
import jetbrains.mps.smodel.adapter.structure.MetaAdapterFactory;
import org.jetbrains.mps.openapi.language.SProperty;

public class check_Child_NonTypesystemRule extends AbstractNonTypesystemRule_Runtime implements NonTypesystemRule_Runtime {
  public check_Child_NonTypesystemRule() {
  }
  public void applyRule(final SNode child, final TypeCheckingContext typeCheckingContext, IsApplicableStatus status) {
    SNode parent = SNodeOperations.getNodeAncestor(child, CONCEPTS.Parent$oV, false, false);
    Iterable<SNode> children = SNodeOperations.getNodeDescendants(parent, CONCEPTS.Child$Bt, false, new SAbstractConcept[]{});
    if (Sequence.fromIterable(children).any(new IWhereFilter<SNode>() {
      public boolean accept(SNode it) {
        return Objects.equals(SPropertyOperations.getString(it, PROPS.name$tAp1), SPropertyOperations.getString(child, PROPS.name$tAp1)) && !(Objects.equals(it, child));
      }
    })) {
      {
        final MessageTarget errorTarget = new NodeMessageTarget();
        IErrorReporter _reporter_2309309498 = typeCheckingContext.reportTypeError(child, "duplicate child name", "r:d22a1b4a-15e3-4d97-b665-acd3f1053f80(GenericDSL.typesystem)", "6341735222733543719", null, errorTarget);
      }
    }
  }
  public SAbstractConcept getApplicableConcept() {
    return CONCEPTS.Child$Bt;
  }
  public IsApplicableStatus isApplicableAndPattern(SNode argument) {
    return new IsApplicableStatus(argument.getConcept().isSubConceptOf(getApplicableConcept()), null);
  }
  public boolean overrides() {
    return false;
  }

  private static final class CONCEPTS {
    /*package*/ static final SConcept Parent$oV = MetaAdapterFactory.getConcept(0x7a5361d88b2b4f3aL, 0xa89a5c606c9b345bL, 0x58025e95ca9c6820L, "GenericDSL.structure.Parent");
    /*package*/ static final SConcept Child$Bt = MetaAdapterFactory.getConcept(0x7a5361d88b2b4f3aL, 0xa89a5c606c9b345bL, 0x58025e95ca9c6829L, "GenericDSL.structure.Child");
  }

  private static final class PROPS {
    /*package*/ static final SProperty name$tAp1 = MetaAdapterFactory.getProperty(0xceab519525ea4f22L, 0x9b92103b95ca8c0cL, 0x110396eaaa4L, 0x110396ec041L, "name");
  }
}
