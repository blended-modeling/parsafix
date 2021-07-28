package GenericDSL.structure;

/*Generated by MPS */

import jetbrains.mps.smodel.runtime.BaseStructureAspectDescriptor;
import jetbrains.mps.smodel.runtime.ConceptDescriptor;
import java.util.Collection;
import java.util.Arrays;
import org.jetbrains.annotations.Nullable;
import jetbrains.mps.smodel.adapter.ids.SConceptId;
import org.jetbrains.mps.openapi.language.SAbstractConcept;
import jetbrains.mps.smodel.runtime.impl.ConceptDescriptorBuilder2;

public class StructureAspectDescriptor extends BaseStructureAspectDescriptor {
  /*package*/ final ConceptDescriptor myConceptChild = createDescriptorForChild();
  /*package*/ final ConceptDescriptor myConceptIContent = createDescriptorForIContent();
  /*package*/ final ConceptDescriptor myConceptParent = createDescriptorForParent();
  /*package*/ final ConceptDescriptor myConceptRoot = createDescriptorForRoot();
  private final LanguageConceptSwitch myIndexSwitch;

  public StructureAspectDescriptor() {
    myIndexSwitch = new LanguageConceptSwitch();
  }


  @Override
  public void reportDependencies(jetbrains.mps.smodel.runtime.StructureAspectDescriptor.Dependencies deps) {
    deps.extendedLanguage(0xceab519525ea4f22L, 0x9b92103b95ca8c0cL, "jetbrains.mps.lang.core");
  }

  @Override
  public Collection<ConceptDescriptor> getDescriptors() {
    return Arrays.asList(myConceptChild, myConceptIContent, myConceptParent, myConceptRoot);
  }

  @Override
  @Nullable
  public ConceptDescriptor getDescriptor(SConceptId id) {
    switch (myIndexSwitch.index(id)) {
      case LanguageConceptSwitch.Child:
        return myConceptChild;
      case LanguageConceptSwitch.IContent:
        return myConceptIContent;
      case LanguageConceptSwitch.Parent:
        return myConceptParent;
      case LanguageConceptSwitch.Root:
        return myConceptRoot;
      default:
        return null;
    }
  }


  /*package*/ int internalIndex(SAbstractConcept c) {
    return myIndexSwitch.index(c);
  }

  private static ConceptDescriptor createDescriptorForChild() {
    ConceptDescriptorBuilder2 b = new ConceptDescriptorBuilder2("GenericDSL", "Child", 0x7a5361d88b2b4f3aL, 0xa89a5c606c9b345bL, 0x58025e95ca9c6829L);
    b.class_(false, false, false);
    b.parent(0xceab519525ea4f22L, 0x9b92103b95ca8c0cL, 0x110396eaaa4L);
    b.origin("r:1b5f3847-45e0-4e0f-b52a-14863b12b412(GenericDSL.structure)/6341735222733465641");
    b.version(2);
    b.alias("child");
    return b.create();
  }
  private static ConceptDescriptor createDescriptorForIContent() {
    ConceptDescriptorBuilder2 b = new ConceptDescriptorBuilder2("GenericDSL", "IContent", 0x7a5361d88b2b4f3aL, 0xa89a5c606c9b345bL, 0x58025e95ca9c6824L);
    b.interface_();
    b.origin("r:1b5f3847-45e0-4e0f-b52a-14863b12b412(GenericDSL.structure)/6341735222733465636");
    b.version(2);
    return b.create();
  }
  private static ConceptDescriptor createDescriptorForParent() {
    ConceptDescriptorBuilder2 b = new ConceptDescriptorBuilder2("GenericDSL", "Parent", 0x7a5361d88b2b4f3aL, 0xa89a5c606c9b345bL, 0x58025e95ca9c6820L);
    b.class_(false, false, false);
    b.parent(0xceab519525ea4f22L, 0x9b92103b95ca8c0cL, 0x110396eaaa4L);
    b.parent(0x7a5361d88b2b4f3aL, 0xa89a5c606c9b345bL, 0x58025e95ca9c6824L);
    b.origin("r:1b5f3847-45e0-4e0f-b52a-14863b12b412(GenericDSL.structure)/6341735222733465632");
    b.version(2);
    b.aggregate("children", 0x58025e95ca9c682cL).target(0x7a5361d88b2b4f3aL, 0xa89a5c606c9b345bL, 0x58025e95ca9c6829L).optional(true).ordered(true).multiple(true).origin("6341735222733465644").done();
    b.alias("parent");
    return b.create();
  }
  private static ConceptDescriptor createDescriptorForRoot() {
    ConceptDescriptorBuilder2 b = new ConceptDescriptorBuilder2("GenericDSL", "Root", 0x7a5361d88b2b4f3aL, 0xa89a5c606c9b345bL, 0x58025e95ca9c6823L);
    b.class_(false, false, true);
    b.parent(0xceab519525ea4f22L, 0x9b92103b95ca8c0cL, 0x110396eaaa4L);
    b.origin("r:1b5f3847-45e0-4e0f-b52a-14863b12b412(GenericDSL.structure)/6341735222733465635");
    b.version(2);
    b.aggregate("content", 0x58025e95ca9c6825L).target(0x7a5361d88b2b4f3aL, 0xa89a5c606c9b345bL, 0x58025e95ca9c6824L).optional(true).ordered(true).multiple(true).origin("6341735222733465637").done();
    b.alias("root");
    return b.create();
  }
}