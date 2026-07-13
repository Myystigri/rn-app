=== maya_introduction ===

# id:intro.maya.001
# speaker:maya
# conversation:maya
Are you there?

* [Yeah. What's going on?]
    # id:intro.player.001
    # speaker:player
    # conversation:maya
    Yeah. What's going on?

    # id:intro.maya.002
    # speaker:maya
    # conversation:maya
    I think someone is inside my apartment.

    -> maya_apartment_warning

* [Who is this?]
    # id:intro.player.002
    # speaker:player
    # conversation:maya
    Who is this?

    # id:intro.maya.003
    # speaker:maya
    # conversation:maya
    Very funny.

    # id:intro.maya.004
    # speaker:maya
    # conversation:maya
    I do not have time for this.

    -> maya_apartment_warning

=== maya_apartment_warning ===

# id:intro.maya.005
# speaker:maya
# conversation:maya
I am serious. The front door just moved.

* [Call the police.]
    # id:intro.player.003
    # speaker:player
    # conversation:maya
    Call the police.

    # id:intro.maya.006
    # speaker:maya
    # conversation:maya
    If I make noise, whoever is out there will know where I am.

    -> maya_waiting

* [Lock yourself in the bathroom.]
    # id:intro.player.004
    # speaker:player
    # conversation:maya
    Lock yourself in the bathroom.

    # id:intro.maya.007
    # speaker:maya
    # conversation:maya
    Doing it now.

    -> maya_waiting

=== maya_waiting ===

# id:intro.maya.008
# speaker:maya
# conversation:maya
Okay. Bathroom door is locked.

# id:intro.maya.009
# speaker:maya
# conversation:maya
I can hear footsteps in the hall.

# id:intro.maya.010
# speaker:maya
# conversation:maya
Stay here. I am going to keep texting.

# type:unlock-app
# id:intro.unlock.case-files
# app:case-files

# type:notification
# id:intro.notification.case-files
# app:case-files
# title:Case Files unlocked
# body:Maya synced a new surface to your phone.

-> END
